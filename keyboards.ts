// Keyboards for Deno bot
import {
  InlineKeyboard,
  InlineKeyboardButton,
  Keyboard,
} from "https://deno.land/x/grammy@v1.19.0/mod.ts";

import { CATEGORIES, PRODUCTS, ITEMS_PER_PAGE } from "./config.ts";

// Main menu keyboard (reply)
export function getMainMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text("🛍️ Каталог")
    .text("🛒 Корзина")
    .row()
    .text("👤 Профиль")
    .text("📞 Связаться с менеджером");
}

// Catalog categories keyboard
export function getCatalogKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const [catId, catName] of Object.entries(CATEGORIES)) {
    keyboard.text(catName, `category_${catId}`);
  }
  keyboard.text("🔙 Главное меню", "main_menu");
  return keyboard;
}

// Products pagination keyboard
export function getProductsKeyboard(category: string, page: number = 0): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const products = PRODUCTS[category] || [];
  const totalPages = products.length > 0 
    ? Math.ceil(products.length / ITEMS_PER_PAGE) 
    : 1;

  const startIdx = page * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const pageProducts = products.slice(startIdx, endIdx);

  // Product buttons
  for (const product of pageProducts) {
    keyboard.text(`${product.name} - ${product.price}₽`, `product_${product.id}`);
  }

  // Pagination
  const navButtons: Array<[string, string]> = [];
  if (page > 0) {
    navButtons.push(["⬅️ Назад", `products_${category}_${page - 1}`]);
  }
  if (page < totalPages - 1) {
    navButtons.push(["Вперед ➡️", `products_${category}_${page + 1}`]);
  }
  if (navButtons.length > 0) {
    keyboard.row(...navButtons.map(([text, data]) => 
      InlineKeyboard.Button.text(text, data)
    ));
  }

  keyboard.text("🔙 Категории", "catalog");
  keyboard.text("🔙 Главное меню", "main_menu");
  return keyboard;
}

// Product detail keyboard
export function getProductKeyboard(productId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("🛒 Добавить в корзину", `add_to_cart_${productId}`)
    .text("🔙 Назад к товарам", "products_back")
    .text("🔙 Категории", "catalog");
}

// Cart keyboard
export function getCartKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("💳 Оформить заказ", "checkout")
    .text("🗑️ Очистить корзину", "clear_cart")
    .text("🔙 Главное меню", "main_menu");
}

// Cart item keyboard with quantity controls
export function getCartItemKeyboard(productId: string, quantity: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("➖", `cart_qty_${productId}_${quantity - 1}`)
    .text(`${quantity} шт`, `cart_qty_ignore`)
    .text("➕", `cart_qty_${productId}_${quantity + 1}`)
    .row()
    .text("🗑 Удалить товар", `remove_from_cart_${productId}`)
    .text("🔙 Назад к корзине", "cart_view");
}

// Checkout keyboard
export function getCheckoutKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Подтвердить и оплатить", "confirm_payment")
    .text("🔙 Назад к корзине", "cart_view");
}

// Back keyboard
export function getBackKeyboard(backCallback: string): InlineKeyboard {
  return new InlineKeyboard().text("🔙 Назад", backCallback);
}

// Admin keyboards
export function getAdminMainKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📦 Необработанные заказы", "admin_pending_orders")
    .text("📋 Все заказы", "admin_all_orders")
    .text("💬 Запросы поддержки", "admin_support_requests")
    .text("🔙 В бот", "main_menu");
}

export function getAdminOrdersKeyboard(orders: Array<{ id: number; total_amount: number; first_name: string; status: string }>): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const order of orders.slice(0, 10)) {
    const icon = order.status === "pending" ? "⏳" : "✅";
    keyboard.text(
      `${icon} Заказ #${order.id} - ${order.total_amount}₽ (${order.first_name})`,
      `admin_order_${order.id}`
    );
  }
  keyboard.text("🔙 Админка", "admin_menu");
  return keyboard;
}

export function getAdminOrderDetailKeyboard(orderId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Отметить как отправленный", `admin_order_shipped_${orderId}`)
    .text("🔙 К заказам", "admin_pending_orders");
}

export function getAdminSupportKeyboard(requests: Array<{ id: number; user_id: number; username: string | null; status: string }>): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const req of requests.slice(0, 10)) {
    const icon = req.status === "pending" ? "🔴" : "🟢";
    const username = req.username || `user_${req.user_id}`;
    keyboard.text(`${icon} #${req.id} от @${username}`, `admin_support_${req.id}`);
  }
  keyboard.text("🔙 Админка", "admin_menu");
  return keyboard;
}

export function getAdminSupportDetailKeyboard(requestId: number, userId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✍️ Ответить", `admin_reply_${requestId}`)
    .text("✅ Закрыть запрос", `admin_support_resolve_${requestId}`)
    .text("🔙 К поддержке", "admin_support_requests");
}

export function getAdminReplyKeyboard(requestId: number): InlineKeyboard {
  return new InlineKeyboard().text("❌ Отмена", `admin_support_${requestId}`);
}
