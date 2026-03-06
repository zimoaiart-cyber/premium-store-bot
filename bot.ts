/**
 * Premium Store Telegram Bot - Deno Deploy Version
 * Serverless bot for Hugging Face Spaces or Deno Deploy
 */
import {
  Bot,
  Context,
  InlineKeyboard,
  Keyboard,
  webhookCallback,
} from "https://deno.land/x/grammy@v1.19.0/mod.ts";

import { config, isWebhook, PRODUCTS, CATEGORIES } from "./config.ts";
import {
  initPool,
  getPool,
  addUser,
  getUser,
  addToCart,
  getCartItems,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartTotal,
  getCartCount,
  createOrder,
  addOrderItem,
  updateOrderStatus,
  getOrder,
  getOrderItems,
  getPendingOrders,
  createManagerRequest,
  getPendingManagerRequests,
  getManagerRequest,
  setAdminResponse,
  resolveManagerRequest,
} from "./database.ts";
import * as keyboards from "./keyboards.ts";

// Validate configuration
if (!config.botToken || config.botToken === "your_bot_token_here") {
  console.error("BOT_TOKEN not configured!");
  Deno.exit(1);
}

if (!config.databaseUrl || config.databaseUrl === "postgresql://...") {
  console.error("DATABASE_URL not configured!");
  Deno.exit(1);
}

// Initialize bot
const bot = new Bot(config.botToken);

// User context for state management
const userContext = new Map<number, {
  category?: string;
  page?: number;
  currentProduct?: string;
  replyRequestId?: number;
}>();

// Admin state for reply mode
const adminReplyState = new Map<number, { requestId: number }>();

// Helper: Check if user is admin
function isAdmin(userId: number): boolean {
  return userId === config.adminId;
}

// Helper: Notify admin
async function notifyAdmin(ctx: Context, message: string): Promise<void> {
  if (config.adminId) {
    try {
      await ctx.api.sendMessage(config.adminId, message);
    } catch (e) {
      console.error("Failed to notify admin:", e);
    }
  }
}

// Helper: Get product by ID
function getProductById(productId: string) {
  for (const products of Object.values(PRODUCTS)) {
    for (const product of products) {
      if (product.id === productId) return product;
    }
  }
  return null;
}

// ==================== START COMMAND ====================

bot.command("start", async (ctx: Context) => {
  const user = ctx.from;
  const client = await getPool().connect();
  
  try {
    await addUser(client, user.id, user.username || "", user.first_name || "", user.last_name);
    
    // Clear states
    userContext.delete(user.id);
    adminReplyState.delete(user.id);
    
    const text = `👋 Добро пожаловать, ${user.first_name}!\n\n` +
      `🛍️ PREMIUM STORE — ваш магазин премиальной одежды.\n\n` +
      `Выберите действие в меню ниже:`;
    
    await ctx.reply(text, {
      reply_markup: keyboards.getMainMenuKeyboard(),
    });
  } finally {
    client.release();
  }
});

// ==================== MAIN MENU ====================

bot.on("message:text", async (ctx: Context) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;
  const client = await getPool().connect();
  
  try {
    // Check admin reply mode
    if (adminReplyState.has(userId)) {
      if (text === "/cancel" || text.toLowerCase() === "отмена") {
        adminReplyState.delete(userId);
        await ctx.reply("❌ Ответ отменен.", {
          reply_markup: keyboards.getAdminMainKeyboard(),
        });
        return;
      }
      
      const { requestId } = adminReplyState.get(userId)!;
      const request = await getManagerRequest(client, requestId);
      
      if (!request) {
        await ctx.reply("❌ Запрос не найден");
        adminReplyState.delete(userId);
        return;
      }
      
      // Save response
      await setAdminResponse(client, requestId, text);
      
      // Forward to user
      try {
        await ctx.api.sendMessage(
          request.user_id,
          `📩 Ответ от поддержки PREMIUM STORE\n\n` +
          `По вашему запросу #${requestId}:\n\n${text}`
        );
      } catch (e) {
        await ctx.reply(`⚠️ Не удалось отправить ответ: ${e}`);
        return;
      }
      
      adminReplyState.delete(userId);
      await ctx.reply(`✅ Ответ на запрос #${requestId} отправлен.`, {
        reply_markup: keyboards.getAdminMainKeyboard(),
      });
      return;
    }
    
    // User commands
    switch (text) {
      case "🛍️ Каталог":
        await ctx.reply("📂 Категории товаров\n\nВыберите категорию:", {
          reply_markup: keyboards.getCatalogKeyboard(),
        });
        break;
        
      case "🛒 Корзина": {
        const cartItems = await getCartItems(client, userId);
        const total = await getCartTotal(client, userId);
        
        if (cartItems.length === 0) {
          await ctx.reply("🛒 Ваша корзина пуста\n\nДобавьте товары из каталога!", {
            reply_markup: keyboards.getBackKeyboard("main_menu"),
          });
          return;
        }
        
        let message = "🛒 Ваша корзина\n\n";
        for (const item of cartItems) {
          message += `• ${item.product_name}\n`;
          message += `  ${item.quantity} шт x ${item.price} руб = ${item.price * item.quantity} руб\n\n`;
        }
        message += "━━━━━━━━━━━━━━━━\n";
        message += `Итого: ${total} руб.`;
        
        await ctx.reply(message, {
          reply_markup: keyboards.getCartKeyboard(),
        });
        break;
      }
        
      case "👤 Профиль": {
        const cartCount = await getCartCount(client, userId);
        const cartTotal = await getCartTotal(client, userId);
        
        let message = `👤 Профиль\n\n`;
        message += `👋 ${user?.first_name}`;
        if (user?.username) message += ` (@${user.username})`;
        message += `\n\n🛒 В корзине: ${cartCount} товаров на ${cartTotal} руб.`;
        
        await ctx.reply(message);
        break;
      }
        
      case "📞 Связаться с менеджером":
        await ctx.reply(
          "📞 Связь с менеджером\n\n" +
          "Опишите ваш вопрос или пожелание:\n" +
          "(или отправьте /cancel для отмены)",
          {
            reply_markup: keyboards.getBackKeyboard("manager_cancel"),
          }
        );
        userContext.set(userId, { ...userContext.get(userId), waitingForMessage: true });
        break;
        
      default:
        // Check if waiting for manager message
        const context = userContext.get(userId);
        if (context?.waitingForMessage) {
          if (text === "/cancel" || text.toLowerCase() === "отмена") {
            userContext.delete(userId);
            await ctx.reply("❌ Запрос отменен.", {
              reply_markup: keyboards.getMainMenuKeyboard(),
            });
            return;
          }
          
          const requestId = await createManagerRequest(client, userId, text);
          
          // Notify admin
          const username = user?.username ? `@${user.username}` : "";
          await notifyAdmin(
            ctx,
            `🔔 Новый запрос менеджеру!\n\n` +
            `👤 Пользователь: ${user?.first_name} ${username}\n` +
            `🆔 ID: ${userId}\n` +
            `📝 Запрос #${requestId}\n\n` +
            `💬 Сообщение:\n${text}`
          );
          
          userContext.delete(userId);
          await ctx.reply(
            "✅ Ваш запрос отправлен менеджеру.\n\n" +
            "Мы свяжемся с вами в ближайшее время.",
            { reply_markup: keyboards.getMainMenuKeyboard() }
          );
          return;
        }
        
        // Fallback
        await ctx.reply(
          "🤔 Я не совсем понял ваш запрос.\n\n" +
          "Пожалуйста, используйте кнопки меню для навигации:\n" +
          "• 🛍️ Каталог — просмотр товаров\n" +
          "• 🛒 Корзина — ваши заказы\n" +
          "• 👤 Профиль — информация о вас\n" +
          "• 📞 Связаться с менеджером — помощь",
          { reply_markup: keyboards.getMainMenuKeyboard() }
        );
    }
  } finally {
    client.release();
  }
});

// ==================== CALLBACK QUERIES ====================

bot.on("callback_query:data", async (ctx: Context) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  const client = await getPool().connect();
  
  try {
    switch (data) {
      case "main_menu":
        userContext.delete(userId);
        adminReplyState.delete(userId);
        await ctx.editMessageText("🛍️ PREMIUM STORE\n\nВыберите действие:", {
          reply_markup: keyboards.getMainMenuKeyboard(),
        });
        break;
        
      case "catalog":
        await ctx.editMessageText("📂 Категории товаров\n\nВыберите категорию:", {
          reply_markup: keyboards.getCatalogKeyboard(),
        });
        break;
        
      case "manager_cancel":
        userContext.delete(userId);
        await ctx.editMessageText("❌ Запрос отменен.", {
          reply_markup: keyboards.getMainMenuKeyboard(),
        });
        break;
        
      case "cart_view": {
        const cartItems = await getCartItems(client, userId);
        const total = await getCartTotal(client, userId);
        
        if (cartItems.length === 0) {
          await ctx.editMessageText("🛒 Ваша корзина пуста\n\nДобавьте товары из каталога!", {
            reply_markup: keyboards.getBackKeyboard("main_menu"),
          });
          return;
        }
        
        let message = "🛒 Ваша корзина\n\n";
        for (const item of cartItems) {
          message += `• ${item.product_name}\n`;
          message += `  ${item.quantity} шт x ${item.price} руб = ${item.price * item.quantity} руб\n\n`;
        }
        message += "━━━━━━━━━━━━━━━━\n";
        message += `Итого: ${total} руб.`;
        
        await ctx.editMessageText(message, {
          reply_markup: keyboards.getCartKeyboard(),
        });
        break;
      }
        
      case "clear_cart":
        await clearCart(client, userId);
        await ctx.answerCallbackQuery("🗑️ Корзина очищена");
        // Refresh cart
        await ctx.editMessageText("🛒 Ваша корзина пуста\n\nДобавьте товары из каталога!", {
          reply_markup: keyboards.getBackKeyboard("main_menu"),
        });
        break;
        
      case "checkout": {
        const total = await getCartTotal(client, userId);
        if (total === 0) {
          await ctx.answerCallbackQuery("❌ Корзина пуста", { show_alert: true });
          return;
        }
        
        const cartItems = await getCartItems(client, userId);
        let message = "💳 Оформление заказа\n\nТовары:\n";
        for (const item of cartItems) {
          message += `• ${item.product_name} x${item.quantity} — ${item.price * item.quantity}₽\n`;
        }
        message += `\n━━━━━━━━━━━━━━━━\nК оплате: ${total} руб.\n\n`;
        message += "Нажмите 'Подтвердить и оплатить' для перехода к оплате.";
        
        await ctx.editMessageText(message, {
          reply_markup: keyboards.getCheckoutKeyboard(),
        });
        break;
      }
        
      case "confirm_payment": {
        const total = await getCartTotal(client, userId);
        if (total === 0) {
          await ctx.answerCallbackQuery("❌ Корзина пуста", { show_alert: true });
          return;
        }
        
        const orderId = await createOrder(client, userId, total);
        const cartItems = await getCartItems(client, userId);
        
        for (const item of cartItems) {
          await addOrderItem(client, orderId, item.product_id, item.product_name, item.price, item.quantity);
        }
        
        await clearCart(client, userId);
        await updateOrderStatus(client, orderId, "confirmed");
        
        await ctx.reply(`✅ Заказ #${orderId} подтвержден!\n\nСумма: ${total} руб.\n\nМенеджер свяжется с вами для уточнения деталей оплаты.`);
        
        // Notify admin
        await notifyAdmin(
          ctx,
          `🔔 Новый заказ #${orderId}\nПользователь: ${ctx.from?.first_name}\nСумма: ${total} руб.`
        );
        
        await ctx.answerCallbackQuery();
        break;
      }
        
      // Admin panel
      case "admin_menu":
        if (!isAdmin(userId)) {
          await ctx.answerCallbackQuery("❌ Доступ запрещен", { show_alert: true });
          return;
        }
        await ctx.editMessageText("🔑 Панель администратора\n\nВыберите действие:", {
          reply_markup: keyboards.getAdminMainKeyboard(),
        });
        break;
        
      case "admin_pending_orders": {
        if (!isAdmin(userId)) {
          await ctx.answerCallbackQuery("❌ Доступ запрещен", { show_alert: true });
          return;
        }
        const orders = await getPendingOrders(client);
        if (orders.length === 0) {
          await ctx.answerCallbackQuery("✅ Нет необработанных заказов", { show_alert: true });
          return;
        }
        await ctx.editMessageText("📦 Необработанные заказы:", {
          reply_markup: keyboards.getAdminOrdersKeyboard(orders),
        });
        break;
      }
        
      case "admin_all_orders": {
        if (!isAdmin(userId)) {
          await ctx.answerCallbackQuery("❌ Доступ запрещен", { show_alert: true });
          return;
        }
        await ctx.answerCallbackQuery("Функция в разработке", { show_alert: true });
        break;
      }
        
      case "admin_support_requests": {
        if (!isAdmin(userId)) {
          await ctx.answerCallbackQuery("❌ Доступ запрещен", { show_alert: true });
          return;
        }
        const requests = await getPendingManagerRequests(client);
        if (requests.length === 0) {
          await ctx.answerCallbackQuery("✅ Нет необработанных запросов", { show_alert: true });
          return;
        }
        await ctx.editMessageText("💬 Запросы поддержки:", {
          reply_markup: keyboards.getAdminSupportKeyboard(requests),
        });
        break;
      }
        
      default:
        // Category selection
        if (data.startsWith("category_")) {
          const category = data.replace("category_", "");
          userContext.set(userId, { category, page: 0 });
          await showProductsPage(ctx, category, 0);
          return;
        }
        
        // Products pagination
        if (data.startsWith("products_")) {
          const parts = data.split("_");
          const category = parts[1];
          const page = parseInt(parts[2]);
          await showProductsPage(ctx, category, page);
          return;
        }
        
        // Product detail
        if (data.startsWith("product_")) {
          const productId = data.replace("product_", "");
          const product = getProductById(productId);
          
          if (!product) {
            await ctx.answerCallbackQuery("❌ Товар не найден", { show_alert: true });
            return;
          }
          
          userContext.set(userId, { ...userContext.get(userId), currentProduct: productId });
          
          const text = `🏷️ ${product.name}\n\n` +
            `💰 Цена: ${product.price} руб.\n\n` +
            `📝 Описание:\n${product.description}`;
          
          try {
            await ctx.replyWithPhoto(product.photo_url, {
              caption: text,
              reply_markup: keyboards.getProductKeyboard(productId),
            });
          } catch {
            await ctx.reply(text, {
              reply_markup: keyboards.getProductKeyboard(productId),
            });
          }
          await ctx.answerCallbackQuery();
          return;
        }
        
        // Add to cart
        if (data.startsWith("add_to_cart_")) {
          const productId = data.replace("add_to_cart_", "");
          const product = getProductById(productId);
          
          if (!product) {
            await ctx.answerCallbackQuery("❌ Товар не найден", { show_alert: true });
            return;
          }
          
          await addToCart(client, userId, productId, product.name, product.price, 1);
          await ctx.answerCallbackQuery(`✅ ${product.name} добавлен в корзину!`);
          return;
        }
        
        // Cart quantity change
        if (data.startsWith("cart_qty_")) {
          const parts = data.split("_");
          const productId = parts[2];
          const newQuantity = parseInt(parts[3]);
          
          if (newQuantity <= 0) {
            await removeFromCart(client, userId, productId);
            await ctx.answerCallbackQuery("❌ Товар удален");
          } else {
            await updateCartQuantity(client, userId, productId, newQuantity);
            await ctx.answerCallbackQuery(`✅ Количество: ${newQuantity} шт`);
          }
          
          // Refresh cart
          const cartItems = await getCartItems(client, userId);
          const total = await getCartTotal(client, userId);
          
          if (cartItems.length === 0) {
            await ctx.editMessageText("🛒 Ваша корзина пуста\n\nДобавьте товары из каталога!", {
              reply_markup: keyboards.getBackKeyboard("main_menu"),
            });
            return;
          }
          
          let message = "🛒 Ваша корзина\n\n";
          for (const item of cartItems) {
            message += `• ${item.product_name}\n`;
            message += `  ${item.quantity} шт x ${item.price} руб = ${item.price * item.quantity} руб\n\n`;
          }
          message += "━━━━━━━━━━━━━━━━\n";
          message += `Итого: ${total} руб.`;
          
          await ctx.editMessageText(message, {
            reply_markup: keyboards.getCartKeyboard(),
          });
          return;
        }
        
        // Remove from cart
        if (data.startsWith("remove_from_cart_")) {
          const productId = data.replace("remove_from_cart_", "");
          const product = getProductById(productId);
          
          await removeFromCart(client, userId, productId);
          await ctx.answerCallbackQuery(`❌ ${product?.name || "Товар"} удален из корзины`);
          
          // Refresh cart
          const cartItems = await getCartItems(client, userId);
          const total = await getCartTotal(client, userId);
          
          if (cartItems.length === 0) {
            await ctx.editMessageText("🛒 Ваша корзина пуста\n\nДобавьте товары из каталога!", {
              reply_markup: keyboards.getBackKeyboard("main_menu"),
            });
            return;
          }
          
          let message = "🛒 Ваша корзина\n\n";
          for (const item of cartItems) {
            message += `• ${item.product_name}\n`;
            message += `  ${item.quantity} шт x ${item.price} руб = ${item.price * item.quantity} руб\n\n`;
          }
          message += "━━━━━━━━━━━━━━━━\n";
          message += `Итого: ${total} руб.`;
          
          await ctx.editMessageText(message, {
            reply_markup: keyboards.getCartKeyboard(),
          });
          return;
        }
        
        // Admin: Order detail
        if (data.startsWith("admin_order_") && !data.includes("shipped")) {
          if (!isAdmin(userId)) {
            await ctx.answerCallbackQuery("❌ Доступ запрещен", { show_alert: true });
            return;
          }
          const orderId = parseInt(data.replace("admin_order_", ""));
          const order = await getOrder(client, orderId);
          
          if (!order) {
            await ctx.answerCallbackQuery("❌ Заказ не найден", { show_alert: true });
            return;
          }
          
          const orderItems = await getOrderItems(client, orderId);
          let text = `📦 Заказ #${orderId}\n\n`;
          text += `👤 Клиент: ${order.first_name || "N/A"}\n`;
          text += `🆔 User ID: ${order.user_id}\n\n`;
          text += "📝 Товары:\n";
          for (const item of orderItems) {
            text += `• ${item.product_name} x${item.quantity} — ${item.price * item.quantity}₽\n`;
          }
          text += `\n━━━━━━━━━━━━━━━━\n💰 Сумма: ${order.total_amount}₽\n`;
          text += `📊 Статус: ${order.status}`;
          
          await ctx.editMessageText(text, {
            reply_markup: keyboards.getAdminOrderDetailKeyboard(orderId),
          });
          return;
        }
        
        // Admin: Mark as shipped
        if (data.startsWith("admin_order_shipped_")) {
          if (!isAdmin(userId)) {
            await ctx.answerCallbackQuery("❌ Доступ запрещен", { show_alert: true });
            return;
          }
          const orderId = parseInt(data.replace("admin_order_shipped_", ""));
          await updateOrderStatus(client, orderId, "shipped");
          
          const order = await getOrder(client, orderId);
          if (order) {
            try {
              await ctx.api.sendMessage(
                order.user_id,
                `✅ Ваш заказ #${orderId} отправлен!\n\nСпасибо за покупку в PREMIUM STORE!`
              );
            } catch (e) {
              console.error("Failed to notify user:", e);
            }
          }
          
          await ctx.answerCallbackQuery("✅ Заказ отмечен как отправленный");
          
          // Refresh orders list
          const orders = await getPendingOrders(client);
          if (orders.length > 0) {
            await ctx.editMessageText("📦 Необработанные заказы:", {
              reply_markup: keyboards.getAdminOrdersKeyboard(orders),
            });
          } else {
            await ctx.editMessageText("✅ Нет необработанных заказов", {
              reply_markup: keyboards.getAdminMainKeyboard(),
            });
          }
          return;
        }
        
        // Admin: Support request detail
        if (data.startsWith("admin_support_") && !data.includes("reply") && !data.includes("resolve")) {
          if (!isAdmin(userId)) {
            await ctx.answerCallbackQuery("❌ Доступ запрещен", { show_alert: true });
            return;
          }
          const requestId = parseInt(data.replace("admin_support_", ""));
          const request = await getManagerRequest(client, requestId);
          
          if (!request) {
            await ctx.answerCallbackQuery("❌ Запрос не найден", { show_alert: true });
            return;
          }
          
          const username = request.username || `user_${request.user_id}`;
          let text = `💬 Запрос #${requestId}\n\n`;
          text += `👤 Пользователь: ${request.first_name} (@${username})\n`;
          text += `🆔 User ID: ${request.user_id}\n\n`;
          text += `📝 Сообщение:\n${request.message_text}\n\n`;
          text += `📊 Статус: ${request.status}`;
          
          if (request.admin_response) {
            text += `\n\n✍️ Ответ админа:\n${request.admin_response}`;
          }
          
          await ctx.editMessageText(text, {
            reply_markup: keyboards.getAdminSupportDetailKeyboard(requestId, request.user_id),
          });
          return;
        }
        
        // Admin: Reply to support
        if (data.startsWith("admin_reply_")) {
          if (!isAdmin(userId)) {
            await ctx.answerCallbackQuery("❌ Доступ запрещен", { show_alert: true });
            return;
          }
          const requestId = parseInt(data.replace("admin_reply_", ""));
          adminReplyState.set(userId, { requestId });
          
          await ctx.reply(
            `✍️ Режим ответа\n\nВведите текст ответа на запрос #${requestId}:\n(или /cancel для отмены)`,
            { reply_markup: keyboards.getAdminReplyKeyboard(requestId) }
          );
          await ctx.answerCallbackQuery();
          return;
        }
        
        // Admin: Resolve support request
        if (data.startsWith("admin_support_resolve_")) {
          if (!isAdmin(userId)) {
            await ctx.answerCallbackQuery("❌ Доступ запрещен", { show_alert: true });
            return;
          }
          const requestId = parseInt(data.replace("admin_support_resolve_", ""));
          await resolveManagerRequest(client, requestId);
          await ctx.answerCallbackQuery("✅ Запрос закрыт");
          
          const requests = await getPendingManagerRequests(client);
          if (requests.length > 0) {
            await ctx.editMessageText("💬 Запросы поддержки:", {
              reply_markup: keyboards.getAdminSupportKeyboard(requests),
            });
          } else {
            await ctx.editMessageText("✅ Нет необработанных запросов", {
              reply_markup: keyboards.getAdminMainKeyboard(),
            });
          }
          return;
        }
        
        await ctx.answerCallbackQuery();
    }
  } finally {
    client.release();
  }
});

// Helper function for products page
async function showProductsPage(ctx: Context, category: string, page: number): Promise<void> {
  const products = PRODUCTS[category] || [];
  const totalPages = products.length > 0 
    ? Math.ceil(products.length / ITEMS_PER_PAGE) 
    : 1;
  
  if (page < 0) page = 0;
  if (page >= totalPages) page = totalPages - 1;
  
  const startIdx = page * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const pageProducts = products.slice(startIdx, endIdx);
  
  const categoryName = CATEGORIES[category] || category;
  let text = `📂 ${categoryName}\nСтраница ${page + 1} из ${totalPages}\n\n`;
  
  for (let i = startIdx + 1; i <= Math.min(endIdx, products.length); i++) {
    const product = products[i - 1];
    text += `${i}. ${product.name} — ${product.price}₽\n`;
  }
  
  try {
    await ctx.editMessageText(text, {
      reply_markup: keyboards.getProductsKeyboard(category, page),
    });
  } catch {
    await ctx.reply(text, {
      reply_markup: keyboards.getProductsKeyboard(category, page),
    });
  }
}

// ==================== ADMIN COMMAND ====================

bot.command("admin", async (ctx: Context) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply("❌ Доступ запрещен");
    return;
  }
  
  await ctx.reply("🔑 Панель администратора\n\nВыберите действие:", {
    reply_markup: keyboards.getAdminMainKeyboard(),
  });
});

// ==================== ERROR HANDLING ====================

bot.catch((err) => {
  console.error("Bot error:", err);
});

// ==================== WEBHOOK & SERVER ====================

if (isWebhook) {
  // Webhook mode for Deno Deploy / Hugging Face
  
  // Initialize database first
  console.log("Initializing database pool...");
  await initPool(config.databaseUrl);
  console.log("Database pool initialized!");
  
  const handler = webhookCallback(bot, "std/http");

  Deno.serve(async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    // Health check
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return new Response("OK");
    }

    // Webhook endpoint
    if (req.method === "POST" && url.pathname === `/webhook/${config.botToken}`) {
      try {
        return await handler(req);
      } catch (err) {
        console.error("Webhook error:", err);
        return new Response("Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  });
} else {
  // Polling mode for local development
  // Note: Deno Deploy doesn't support polling, this is for local testing only
  console.log("Starting bot in polling mode (local development only)...");
  
  // Initialize database
  await initPool(config.databaseUrl);
  console.log("Database connected");
  
  // Set bot commands
  await bot.api.setMyCommands([
    { command: "start", description: "Запустить бота" },
    { command: "admin", description: "Панель администратора" },
    { command: "cancel", description: "Отменить действие" },
  ]);
  
  // Start polling
  bot.start({
    drop_pending_updates: true,
  });
}
