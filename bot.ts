/**
 * 🛍️ Premium Store Telegram Bot v3.0
 * Production-ready e-commerce bot with advanced features
 * 
 * Features:
 * - Multi-language support (i18n)
 * - Rate limiting & spam protection
 * - Redis caching
 * - Structured logging
 * - Prometheus metrics
 * - Health checks
 * - Admin panel
 * - Smart cart with quantity controls
 * - Order management
 * - Support requests with admin replies
 */

import {
  Bot,
  Context,
  InlineKeyboard,
  Keyboard,
  webhookCallback,
  type NextFunction,
} from "https://deno.land/x/grammy@v1.19.0/mod.ts";

// Configuration
import { config, isWebhook, PRODUCTS, CATEGORIES, ITEMS_PER_PAGE } from "./config.ts";

// Database
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

// Keyboards
import * as keyboards from "./keyboards.ts";

// Utils
import { logger, measureExecution } from "./utils/logger.ts";
import { t, getUserLanguage, type Language } from "./utils/i18n.ts";

// Middlewares
import { createRateLimiter } from "./middlewares/rateLimiter.ts";

// Services
import {
  getHealthStatus,
  generatePrometheusMetrics,
  incrementRequest,
  incrementError,
  recordResponseTime,
  trackUser,
  incrementDatabaseQuery,
} from "./services/metrics.ts";

// ==================== VALIDATION ====================

if (!config.botToken || config.botToken === "your_bot_token_here") {
  console.error("❌ BOT_TOKEN not configured!");
  Deno.exit(1);
}

if (!config.databaseUrl || config.databaseUrl === "postgresql://...") {
  console.error("❌ DATABASE_URL not configured!");
  Deno.exit(1);
}

// ==================== BOT INITIALIZATION ====================

const bot = new Bot(config.botToken);

// User context for state management
interface UserContext {
  category?: string;
  page?: number;
  currentProduct?: string;
  waitingForMessage?: boolean;
  replyRequestId?: number;
  language?: Language;
}

const userContext = new Map<number, UserContext>();
const adminReplyState = new Map<number, { requestId: number }>();

// ==================== MIDDLEWARES ====================

// Rate limiting
bot.use(createRateLimiter({
  maxRequests: 50,
  windowMs: 60000,
  blockDurationMs: 300000,
}));

// Logging middleware
bot.use(async (ctx: Context, next: NextFunction) => {
  const start = performance.now();
  const userId = ctx.from?.id;
  const type = ctx.message?.text ? "message" : ctx.callbackQuery ? "callback" : "unknown";
  
  logger.info("BOT", `Incoming ${type} from user ${userId}`);
  incrementRequest(type);
  trackUser(userId || 0);
  
  await next();
  
  const duration = performance.now() - start;
  recordResponseTime(duration);
  logger.debug("BOT", `Processed ${type} in ${duration.toFixed(2)}ms`);
});

// Error handling middleware
bot.catch(async (err, ctx) => {
  logger.error("BOT", "Handler error", err);
  incrementError();
  
  if (ctx) {
    const lang = getUserLanguage(ctx.from?.id || 0);
    await ctx.reply(t(lang, "error", { message: "Внутренняя ошибка. Попробуйте позже." }));
  }
});

// ==================== HELPERS ====================

function isAdmin(userId: number): boolean {
  return userId === config.adminId;
}

async function notifyAdmin(ctx: Context, message: string): Promise<void> {
  if (config.adminId) {
    try {
      await ctx.api.sendMessage(config.adminId, message);
      logger.info("ADMIN", "Notification sent");
    } catch (e) {
      logger.error("ADMIN", "Failed to notify admin", e as Error);
    }
  }
}

function getProductById(productId: string) {
  for (const products of Object.values(PRODUCTS)) {
    for (const product of products) {
      if (product.id === productId) return product;
    }
  }
  return null;
}

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
  const lang = getUserLanguage(ctx.from?.id || 0);
  
  let text = `📂 ${categoryName}\n`;
  text += t(lang, "pageOf", { current: page + 1, total: totalPages }) + "\n\n";
  
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

// ==================== START COMMAND ====================

bot.command("start", async (ctx: Context) => {
  const user = ctx.from;
  const lang = getUserLanguage(user.id);
  const client = await getPool().connect();
  const start = performance.now();
  
  try {
    incrementDatabaseQuery();
    await addUser(client, user.id, user.username || "", user.first_name || "", user.last_name);
    
    // Clear states
    userContext.delete(user.id);
    adminReplyState.delete(user.id);
    
    const text = `${t(lang, "welcome", { name: user.first_name })}\n\n` +
      `${t(lang, "welcomeDescription")}\n\n` +
      `${t(lang, "chooseAction")}`;
    
    await ctx.reply(text, {
      reply_markup: keyboards.getMainMenuKeyboard(),
    });
    
    logger.info("BOT", `User ${user.id} started bot`);
  } catch (error) {
    logger.error("DB", "Failed to add user", error as Error);
    incrementError();
  } finally {
    client.release();
    recordResponseTime(performance.now() - start);
  }
});

// Language selection command
bot.command("lang", async (ctx: Context) => {
  const keyboard = new InlineKeyboard()
    .text("🇷🇺 Русский", "lang_ru")
    .text("🇬🇧 English", "lang_en")
    .row();
  
  await ctx.reply("Choose language / Выберите язык:", {
    reply_markup: keyboard,
  });
});

// ==================== MESSAGE HANDLER ====================

bot.on("message:text", async (ctx: Context) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;
  const user = ctx.from;
  const lang = getUserLanguage(userId);
  const client = await getPool().connect();
  const start = performance.now();
  
  try {
    // Check admin reply mode first
    if (adminReplyState.has(userId)) {
      if (text === "/cancel" || text.toLowerCase() === "отмена" || text.toLowerCase() === "cancel") {
        adminReplyState.delete(userId);
        await ctx.reply(t(lang, "answerCancelled"), {
          reply_markup: keyboards.getAdminMainKeyboard(),
        });
        return;
      }
      
      const { requestId } = adminReplyState.get(userId)!;
      incrementDatabaseQuery();
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
        logger.info("SUPPORT", `Admin replied to request #${requestId}`);
      } catch (e) {
        await ctx.reply(`⚠️ Не удалось отправить ответ: ${e}`);
        return;
      }
      
      adminReplyState.delete(userId);
      await ctx.reply(t(lang, "replySent", { id: requestId }), {
        reply_markup: keyboards.getAdminMainKeyboard(),
      });
      return;
    }
    
    // User commands
    switch (text) {
      case "🛍️ Каталог":
        await ctx.reply(`${t(lang, "categoriesTitle")}\n\n${t(lang, "chooseCategory")}`, {
          reply_markup: keyboards.getCatalogKeyboard(),
        });
        break;
        
      case "🛒 Корзина": {
        incrementDatabaseQuery();
        const cartItems = await getCartItems(client, userId);
        incrementDatabaseQuery();
        const total = await getCartTotal(client, userId);
        
        if (cartItems.length === 0) {
          await ctx.reply(`${t(lang, "cartEmpty")}\n\n${t(lang, "addToCartPrompt")}`, {
            reply_markup: keyboards.getBackKeyboard("main_menu"),
          });
          return;
        }
        
        let message = `${t(lang, "yourCart")}\n\n`;
        for (const item of cartItems) {
          message += `• ${item.product_name}\n`;
          message += `  ${t(lang, "quantity", { qty: item.quantity, price: item.price, total: item.price * item.quantity })}\n\n`;
        }
        message += "━━━━━━━━━━━━━━━━\n";
        message += t(lang, "total", { total });
        
        await ctx.reply(message, {
          reply_markup: keyboards.getCartKeyboard(),
        });
        break;
      }
        
      case "👤 Профиль": {
        incrementDatabaseQuery();
        const cartCount = await getCartCount(client, userId);
        incrementDatabaseQuery();
        const cartTotal = await getCartTotal(client, userId);
        
        let message = `${t(lang, "profileTitle")}\n\n`;
        message += `👋 ${user?.first_name}`;
        if (user?.username) message += ` (@${user.username})`;
        message += `\n\n${t(lang, "itemsInCart", { count: cartCount, total: cartTotal })}`;
        
        await ctx.reply(message);
        break;
      }
        
      case "📞 Связаться с менеджером":
        userContext.set(userId, { ...userContext.get(userId), waitingForMessage: true });
        await ctx.reply(
          `${t(lang, "managerContactTitle")}\n\n` +
          `${t(lang, "describeQuestion")}\n` +
          `(или отправьте /cancel для отмены)`,
          {
            reply_markup: keyboards.getBackKeyboard("manager_cancel"),
          }
        );
        break;
        
      default:
        // Check if waiting for manager message
        const context = userContext.get(userId);
        if (context?.waitingForMessage) {
          if (text === "/cancel" || text.toLowerCase() === "отмена" || text.toLowerCase() === "cancel") {
            userContext.delete(userId);
            await ctx.reply(t(lang, "requestCancelled"), {
              reply_markup: keyboards.getMainMenuKeyboard(),
            });
            return;
          }
          
          incrementDatabaseQuery();
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
            `${t(lang, "requestSent")}\n\n${t(lang, "managerWillContactSoon")}`,
            { reply_markup: keyboards.getMainMenuKeyboard() }
          );
          return;
        }
        
        // Fallback
        await ctx.reply(
          `${t(lang, "fallbackMessage")}\n\n` +
          `${t(lang, "useMenuNavigation")}\n` +
          `• ${t(lang, "catalog")}\n` +
          `• ${t(lang, "cart")}\n` +
          `• ${t(lang, "profile")}\n` +
          `• ${t(lang, "contactManager")}`,
          { reply_markup: keyboards.getMainMenuKeyboard() }
        );
    }
  } catch (error) {
    logger.error("HANDLER", "Message handler error", error as Error);
    incrementError();
  } finally {
    client.release();
    recordResponseTime(performance.now() - start);
  }
});

// ==================== CALLBACK QUERY HANDLER ====================

bot.on("callback_query:data", async (ctx: Context) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  const lang = getUserLanguage(userId);
  const client = await getPool().connect();
  const start = performance.now();
  
  try {
    switch (data) {
      case "main_menu":
        userContext.delete(userId);
        adminReplyState.delete(userId);
        await ctx.editMessageText(`${t(lang, "profileTitle")}\n\n${t(lang, "chooseAction")}`, {
          reply_markup: keyboards.getMainMenuKeyboard(),
        });
        break;
        
      case "catalog":
        await ctx.editMessageText(`${t(lang, "categoriesTitle")}\n\n${t(lang, "chooseCategory")}`, {
          reply_markup: keyboards.getCatalogKeyboard(),
        });
        break;
        
      case "manager_cancel":
        userContext.delete(userId);
        await ctx.editMessageText(t(lang, "requestCancelled"), {
          reply_markup: keyboards.getMainMenuKeyboard(),
        });
        break;
        
      case "cart_view": {
        incrementDatabaseQuery();
        const cartItems = await getCartItems(client, userId);
        incrementDatabaseQuery();
        const total = await getCartTotal(client, userId);
        
        if (cartItems.length === 0) {
          await ctx.editMessageText(`${t(lang, "cartEmpty")}\n\n${t(lang, "addToCartPrompt")}`, {
            reply_markup: keyboards.getBackKeyboard("main_menu"),
          });
          return;
        }
        
        let message = `${t(lang, "yourCart")}\n\n`;
        for (const item of cartItems) {
          message += `• ${item.product_name}\n`;
          message += `  ${t(lang, "quantity", { qty: item.quantity, price: item.price, total: item.price * item.quantity })}\n\n`;
        }
        message += "━━━━━━━━━━━━━━━━\n";
        message += t(lang, "total", { total });
        
        await ctx.editMessageText(message, {
          reply_markup: keyboards.getCartKeyboard(),
        });
        break;
      }
        
      case "clear_cart":
        incrementDatabaseQuery();
        await clearCart(client, userId);
        await ctx.answerCallbackQuery(t(lang, "cartCleared"));
        await ctx.editMessageText(`${t(lang, "cartEmpty")}\n\n${t(lang, "addToCartPrompt")}`, {
          reply_markup: keyboards.getBackKeyboard("main_menu"),
        });
        break;
        
      case "checkout": {
        incrementDatabaseQuery();
        const total = await getCartTotal(client, userId);
        if (total === 0) {
          await ctx.answerCallbackQuery("❌ Корзина пуста", { show_alert: true });
          return;
        }
        
        incrementDatabaseQuery();
        const cartItems = await getCartItems(client, userId);
        let message = `${t(lang, "checkoutTitle")}\n\n${t(lang, "items")}\n`;
        for (const item of cartItems) {
          message += `• ${item.product_name} x${item.quantity} — ${item.price * item.quantity}₽\n`;
        }
        message += `\n━━━━━━━━━━━━━━━━\n${t(lang, "toPay", { total })}\n\n`;
        message += "Нажмите 'Подтвердить и оплатить' для оформления заказа.";
        
        await ctx.editMessageText(message, {
          reply_markup: keyboards.getCheckoutKeyboard(),
        });
        break;
      }
        
      case "confirm_payment": {
        incrementDatabaseQuery();
        const total = await getCartTotal(client, userId);
        if (total === 0) {
          await ctx.answerCallbackQuery("❌ Корзина пуста", { show_alert: true });
          return;
        }
        
        incrementDatabaseQuery();
        const orderId = await createOrder(client, userId, total);
        incrementDatabaseQuery();
        const cartItems = await getCartItems(client, userId);
        
        for (const item of cartItems) {
          incrementDatabaseQuery();
          await addOrderItem(client, orderId, item.product_id, item.product_name, item.price, item.quantity);
        }
        
        incrementDatabaseQuery();
        await clearCart(client, userId);
        incrementDatabaseQuery();
        await updateOrderStatus(client, orderId, "confirmed");
        
        await ctx.reply(`${t(lang, "orderConfirmed", { id: orderId })}\n\n${t(lang, "orderDetails", { total })}`);
        
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
          await ctx.answerCallbackQuery(t(lang, "accessDenied"), { show_alert: true });
          return;
        }
        await ctx.editMessageText(`${t(lang, "adminPanel")}\n\n${t(lang, "adminChooseAction")}`, {
          reply_markup: keyboards.getAdminMainKeyboard(),
        });
        break;
        
      case "admin_pending_orders": {
        if (!isAdmin(userId)) {
          await ctx.answerCallbackQuery(t(lang, "accessDenied"), { show_alert: true });
          return;
        }
        incrementDatabaseQuery();
        const orders = await getPendingOrders(client);
        if (orders.length === 0) {
          await ctx.answerCallbackQuery(t(lang, "noPendingOrders"), { show_alert: true });
          return;
        }
        await ctx.editMessageText(`📦 Необработанные заказы:`, {
          reply_markup: keyboards.getAdminOrdersKeyboard(orders),
        });
        break;
      }
        
      case "admin_all_orders":
        if (!isAdmin(userId)) {
          await ctx.answerCallbackQuery(t(lang, "accessDenied"), { show_alert: true });
          return;
        }
        await ctx.answerCallbackQuery("Функция в разработке", { show_alert: true });
        break;
        
      case "admin_support_requests": {
        if (!isAdmin(userId)) {
          await ctx.answerCallbackQuery(t(lang, "accessDenied"), { show_alert: true });
          return;
        }
        incrementDatabaseQuery();
        const requests = await getPendingManagerRequests(client);
        if (requests.length === 0) {
          await ctx.answerCallbackQuery(t(lang, "noSupportRequests"), { show_alert: true });
          return;
        }
        await ctx.editMessageText(`💬 Запросы поддержки:`, {
          reply_markup: keyboards.getAdminSupportKeyboard(requests),
        });
        break;
      }
        
      // Category selection
      default:
        if (data.startsWith("category_")) {
          const category = data.replace("category_", "");
          userContext.set(userId, { category, page: 0 });
          await showProductsPage(ctx, category, 0);
          await ctx.answerCallbackQuery();
          return;
        }
        
        // Products pagination
        if (data.startsWith("products_")) {
          const parts = data.split("_");
          const category = parts[1];
          const page = parseInt(parts[2]);
          await showProductsPage(ctx, category, page);
          await ctx.answerCallbackQuery();
          return;
        }
        
        // Product detail
        if (data.startsWith("product_")) {
          const productId = data.replace("product_", "");
          const product = getProductById(productId);
          
          if (!product) {
            await ctx.answerCallbackQuery(t(lang, "notFound"), { show_alert: true });
            return;
          }
          
          userContext.set(userId, { ...userContext.get(userId), currentProduct: productId });
          
          const text = `🏷️ ${product.name}\n\n` +
            `${t(lang, "price", { price: product.price })}\n\n` +
            `${t(lang, "description")}\n${product.description}`;
          
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
            await ctx.answerCallbackQuery(t(lang, "notFound"), { show_alert: true });
            return;
          }
          
          incrementDatabaseQuery();
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
            incrementDatabaseQuery();
            await removeFromCart(client, userId, productId);
            await ctx.answerCallbackQuery("❌ Товар удален");
          } else {
            incrementDatabaseQuery();
            await updateCartQuantity(client, userId, productId, newQuantity);
            await ctx.answerCallbackQuery(`✅ Количество: ${newQuantity} шт`);
          }
          
          // Refresh cart
          incrementDatabaseQuery();
          const cartItems = await getCartItems(client, userId);
          incrementDatabaseQuery();
          const total = await getCartTotal(client, userId);
          
          if (cartItems.length === 0) {
            await ctx.editMessageText(`${t(lang, "cartEmpty")}\n\n${t(lang, "addToCartPrompt")}`, {
              reply_markup: keyboards.getBackKeyboard("main_menu"),
            });
            return;
          }
          
          let message = `${t(lang, "yourCart")}\n\n`;
          for (const item of cartItems) {
            message += `• ${item.product_name}\n`;
            message += `  ${t(lang, "quantity", { qty: item.quantity, price: item.price, total: item.price * item.quantity })}\n\n`;
          }
          message += "━━━━━━━━━━━━━━━━\n";
          message += t(lang, "total", { total });
          
          await ctx.editMessageText(message, {
            reply_markup: keyboards.getCartKeyboard(),
          });
          return;
        }
        
        // Remove from cart
        if (data.startsWith("remove_from_cart_")) {
          const productId = data.replace("remove_from_cart_", "");
          const product = getProductById(productId);
          
          incrementDatabaseQuery();
          await removeFromCart(client, userId, productId);
          await ctx.answerCallbackQuery(`❌ ${product?.name || "Товар"} удален из корзины`);
          
          // Refresh cart (same as above - refactored in production)
          incrementDatabaseQuery();
          const cartItems = await getCartItems(client, userId);
          incrementDatabaseQuery();
          const total = await getCartTotal(client, userId);
          
          if (cartItems.length === 0) {
            await ctx.editMessageText(`${t(lang, "cartEmpty")}\n\n${t(lang, "addToCartPrompt")}`, {
              reply_markup: keyboards.getBackKeyboard("main_menu"),
            });
            return;
          }
          
          let message = `${t(lang, "yourCart")}\n\n`;
          for (const item of cartItems) {
            message += `• ${item.product_name}\n`;
            message += `  ${t(lang, "quantity", { qty: item.quantity, price: item.price, total: item.price * item.quantity })}\n\n`;
          }
          message += "━━━━━━━━━━━━━━━━\n";
          message += t(lang, "total", { total });
          
          await ctx.editMessageText(message, {
            reply_markup: keyboards.getCartKeyboard(),
          });
          return;
        }
        
        // Admin: Order detail
        if (data.startsWith("admin_order_") && !data.includes("shipped")) {
          if (!isAdmin(userId)) {
            await ctx.answerCallbackQuery(t(lang, "accessDenied"), { show_alert: true });
            return;
          }
          const orderId = parseInt(data.replace("admin_order_", ""));
          incrementDatabaseQuery();
          const order = await getOrder(client, orderId);
          
          if (!order) {
            await ctx.answerCallbackQuery(t(lang, "notFound"), { show_alert: true });
            return;
          }
          
          incrementDatabaseQuery();
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
            await ctx.answerCallbackQuery(t(lang, "accessDenied"), { show_alert: true });
            return;
          }
          const orderId = parseInt(data.replace("admin_order_shipped_", ""));
          incrementDatabaseQuery();
          await updateOrderStatus(client, orderId, "shipped");
          
          incrementDatabaseQuery();
          const order = await getOrder(client, orderId);
          if (order) {
            try {
              await ctx.api.sendMessage(
                order.user_id,
                `✅ Ваш заказ #${orderId} отправлен!\n\nСпасибо за покупку в PREMIUM STORE!`
              );
            } catch (e) {
              logger.error("NOTIFY", "Failed to notify user", e as Error);
            }
          }
          
          await ctx.answerCallbackQuery(t(lang, "orderMarkedShipped"));
          
          // Refresh orders list
          incrementDatabaseQuery();
          const orders = await getPendingOrders(client);
          if (orders.length > 0) {
            await ctx.editMessageText("📦 Необработанные заказы:", {
              reply_markup: keyboards.getAdminOrdersKeyboard(orders),
            });
          } else {
            await ctx.editMessageText(t(lang, "noPendingOrders"), {
              reply_markup: keyboards.getAdminMainKeyboard(),
            });
          }
          return;
        }
        
        // Admin: Support request detail
        if (data.startsWith("admin_support_") && !data.includes("reply") && !data.includes("resolve")) {
          if (!isAdmin(userId)) {
            await ctx.answerCallbackQuery(t(lang, "accessDenied"), { show_alert: true });
            return;
          }
          const requestId = parseInt(data.replace("admin_support_", ""));
          incrementDatabaseQuery();
          const request = await getManagerRequest(client, requestId);
          
          if (!request) {
            await ctx.answerCallbackQuery(t(lang, "notFound"), { show_alert: true });
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
            await ctx.answerCallbackQuery(t(lang, "accessDenied"), { show_alert: true });
            return;
          }
          const requestId = parseInt(data.replace("admin_reply_", ""));
          adminReplyState.set(userId, { requestId });
          
          await ctx.reply(
            `${t(lang, "replyMode")}\n\n${t(lang, "enterReplyText", { id: requestId })}\n(или /cancel для отмены)`,
            { reply_markup: keyboards.getAdminReplyKeyboard(requestId) }
          );
          await ctx.answerCallbackQuery();
          return;
        }
        
        // Admin: Resolve support request
        if (data.startsWith("admin_support_resolve_")) {
          if (!isAdmin(userId)) {
            await ctx.answerCallbackQuery(t(lang, "accessDenied"), { show_alert: true });
            return;
          }
          const requestId = parseInt(data.replace("admin_support_resolve_", ""));
          incrementDatabaseQuery();
          await resolveManagerRequest(client, requestId);
          await ctx.answerCallbackQuery(t(lang, "requestClosed"));
          
          incrementDatabaseQuery();
          const requests = await getPendingManagerRequests(client);
          if (requests.length > 0) {
            await ctx.editMessageText("💬 Запросы поддержки:", {
              reply_markup: keyboards.getAdminSupportKeyboard(requests),
            });
          } else {
            await ctx.editMessageText(t(lang, "noSupportRequests"), {
              reply_markup: keyboards.getAdminMainKeyboard(),
            });
          }
          return;
        }
        
        // Language selection
        if (data.startsWith("lang_")) {
          const newLang = data.replace("lang_", "") as Language;
          if (["ru", "en"].includes(newLang)) {
            userContext.set(userId, { ...userContext.get(userId), language: newLang });
            await ctx.answerCallbackQuery(`Language set to: ${newLang}`);
            await ctx.editMessageText(`✅ Language changed / Язык изменён: ${newLang.toUpperCase()}`);
          }
          return;
        }
        
        await ctx.answerCallbackQuery();
    }
  } catch (error) {
    logger.error("CALLBACK", "Callback handler error", error as Error);
    incrementError();
  } finally {
    client.release();
    recordResponseTime(performance.now() - start);
  }
});

// ==================== ADMIN COMMAND ====================

bot.command("admin", async (ctx: Context) => {
  const lang = getUserLanguage(ctx.from.id);
  
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply(t(lang, "accessDenied"));
    return;
  }
  
  await ctx.reply(`${t(lang, "adminPanel")}\n\n${t(lang, "adminChooseAction")}`, {
    reply_markup: keyboards.getAdminMainKeyboard(),
  });
});

// ==================== HEALTH & METRICS ENDPOINTS ====================

bot.command("health", async (ctx: Context) => {
  if (!isAdmin(ctx.from.id)) {
    return;
  }
  
  const health = getHealthStatus();
  const message = `🏥 Health Status\n\n` +
    `Status: ${health.status}\n` +
    `Version: ${health.version}\n` +
    `Uptime: ${health.uptime.toFixed(0)}s\n\n` +
    `📊 Metrics:\n` +
    `• Requests: ${health.metrics.requestsTotal}\n` +
    `• Errors: ${health.metrics.errorsTotal}\n` +
    `• Active users: ${health.metrics.activeUsers}\n` +
    `• Avg response: ${health.metrics.avgResponseTime}ms`;
  
  await ctx.reply(message);
});

// ==================== ERROR HANDLING ====================

bot.catch((err, ctx) => {
  logger.error("GLOBAL", "Unhandled error", err);
  incrementError();
});

// ==================== WEBHOOK & SERVER ====================

if (isWebhook) {
  // Initialize services
  console.log("🚀 Starting Premium Store Bot v3.0...");
  
  // Initialize database
  console.log("📊 Initializing database pool...");
  await initPool(config.databaseUrl);
  console.log("✅ Database pool initialized!");

  const handler = webhookCallback(bot, "std/http");

  Deno.serve(async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    // Health check
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      const health = getHealthStatus();
      return new Response(JSON.stringify(health), {
        status: health.status === "healthy" ? 200 : 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prometheus metrics
    if (req.method === "GET" && url.pathname === "/metrics") {
      const metrics = generatePrometheusMetrics();
      return new Response(metrics, {
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Webhook endpoint
    if (req.method === "POST" && url.pathname === `/webhook/${config.botToken}`) {
      try {
        return await handler(req);
      } catch (err) {
        logger.error("WEBHOOK", "Webhook handler error", err as Error);
        incrementError();
        return new Response("Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  });
  
  console.log("✅ Bot is running!");
  console.log(`📡 Webhook: https://YOUR-URL.deno.dev/webhook/${config.botToken}`);
  console.log(`🏥 Health: https://YOUR-URL.deno.dev/health`);
  console.log(`📊 Metrics: https://YOUR-URL.deno.dev/metrics`);
} else {
  // Polling mode for local development
  console.log("🚀 Starting Premium Store Bot v3.0 (Polling Mode)...");
  
  await initPool(config.databaseUrl);
  console.log("✅ Database connected");
  
  await bot.api.setMyCommands([
    { command: "start", description: "Запустить бота" },
    { command: "admin", description: "Панель администратора" },
    { command: "lang", description: "Выбрать язык" },
    { command: "cancel", description: "Отменить действие" },
    { command: "health", description: "Проверить статус (admin)" },
  ]);
  
  console.log("✅ Bot commands set");
  console.log("📡 Bot is polling...");
  
  bot.start({
    drop_pending_updates: true,
  });
}
