/**
 * Internationalization (i18n) Module
 * Multi-language support for the bot
 */

export type Language = "ru" | "en";

export interface Translation {
  // Start
  welcome: string;
  welcomeDescription: string;
  chooseAction: string;
  
  // Main menu
  catalog: string;
  cart: string;
  profile: string;
  contactManager: string;
  
  // Catalog
  categoriesTitle: string;
  chooseCategory: string;
  categoryEmpty: string;
  pageOf: string;
  
  // Product
  price: string;
  description: string;
  addToCart: string;
  backToProducts: string;
  backToCategories: string;
  
  // Cart
  yourCart: string;
  cartEmpty: string;
  addToCartPrompt: string;
  quantity: string;
  total: string;
  clearCart: string;
  itemRemoved: string;
  cartCleared: string;
  
  // Checkout
  checkoutTitle: string;
  items: string;
  toPay: string;
  confirmPayment: string;
  backToCart: string;
  orderConfirmed: string;
  orderDetails: string;
  managerWillContact: string;
  
  // Profile
  profileTitle: string;
  itemsInCart: string;
  
  // Manager
  managerContactTitle: string;
  describeQuestion: string;
  requestSent: string;
  requestCancelled: string;
  managerWillContactSoon: string;
  
  // Admin
  adminPanel: string;
  adminChooseAction: string;
  pendingOrders: string;
  allOrders: string;
  supportRequests: string;
  backToBot: string;
  noPendingOrders: string;
  noSupportRequests: string;
  accessDenied: string;
  orderMarkedShipped: string;
  requestClosed: string;
  replyMode: string;
  enterReplyText: string;
  replySent: string;
  answerCancelled: string;
  
  // Common
  back: string;
  cancel: string;
  error: string;
  notFound: string;
  loading: string;
  
  // Fallback
  fallbackMessage: string;
  useMenuNavigation: string;
}

const translations: Record<Language, Translation> = {
  ru: {
    // Start
    welcome: "👋 Добро пожаловать, {name}!",
    welcomeDescription: "🛍️ PREMIUM STORE — ваш магазин премиальной одежды.",
    chooseAction: "Выберите действие в меню ниже:",
    
    // Main menu
    catalog: "🛍️ Каталог",
    cart: "🛒 Корзина",
    profile: "👤 Профиль",
    contactManager: "📞 Связаться с менеджером",
    
    // Catalog
    categoriesTitle: "📂 Категории товаров",
    chooseCategory: "Выберите категорию:",
    categoryEmpty: "❌ В этой категории пока нет товаров",
    pageOf: "Страница {current} из {total}",
    
    // Product
    price: "💰 Цена: {price} руб.",
    description: "📝 Описание:",
    addToCart: "🛒 Добавить в корзину",
    backToProducts: "🔙 Назад к товарам",
    backToCategories: "🔙 Категории",
    
    // Cart
    yourCart: "🛒 Ваша корзина",
    cartEmpty: "🛒 Ваша корзина пуста",
    addToCartPrompt: "Добавьте товары из каталога!",
    quantity: "{qty} шт x {price} руб = {total} руб",
    total: "Итого: {total} руб.",
    clearCart: "🗑️ Очистить корзину",
    itemRemoved: "❌ {name} удален из корзины",
    cartCleared: "🗑️ Корзина очищена",
    
    // Checkout
    checkoutTitle: "💳 Оформление заказа",
    items: "Товары:",
    toPay: "К оплате: {total} руб.",
    confirmPayment: "✅ Подтвердить и оплатить",
    backToCart: "🔙 Назад к корзине",
    orderConfirmed: "✅ Заказ #{id} подтвержден!",
    orderDetails: "Сумма: {total} руб.\n\nМенеджер свяжется с вами для уточнения деталей.",
    managerWillContact: "Менеджер свяжется с вами в ближайшее время.",
    
    // Profile
    profileTitle: "👤 Профиль",
    itemsInCart: "🛒 В корзине: {count} товаров на {total} руб.",
    
    // Manager
    managerContactTitle: "📞 Связь с менеджером",
    describeQuestion: "Опишите ваш вопрос или пожелание:",
    requestSent: "✅ Ваш запрос отправлен менеджеру.",
    requestCancelled: "❌ Запрос отменен.",
    managerWillContactSoon: "Мы свяжемся с вами в ближайшее время.",
    
    // Admin
    adminPanel: "🔑 Панель администратора",
    adminChooseAction: "Выберите действие:",
    pendingOrders: "📦 Необработанные заказы",
    allOrders: "📋 Все заказы",
    supportRequests: "💬 Запросы поддержки",
    backToBot: "🔙 В бот",
    noPendingOrders: "✅ Нет необработанных заказов",
    noSupportRequests: "✅ Нет необработанных запросов",
    accessDenied: "❌ Доступ запрещен",
    orderMarkedShipped: "✅ Заказ отмечен как отправленный",
    requestClosed: "✅ Запрос закрыт",
    replyMode: "✍️ Режим ответа",
    enterReplyText: "Введите текст ответа на запрос #{id}:",
    replySent: "✅ Ответ на запрос #{id} отправлен.",
    answerCancelled: "❌ Ответ отменен.",
    
    // Common
    back: "🔙 Назад",
    cancel: "❌ Отмена",
    error: "❌ Ошибка: {message}",
    notFound: "❌ Не найдено",
    loading: "⏳ Загрузка...",
    
    // Fallback
    fallbackMessage: "🤔 Я не совсем понял ваш запрос.",
    useMenuNavigation: "Пожалуйста, используйте кнопки меню для навигации:",
  },
  
  en: {
    // Start
    welcome: "👋 Welcome, {name}!",
    welcomeDescription: "🛍️ PREMIUM STORE — your premium clothing store.",
    chooseAction: "Choose an action from the menu below:",
    
    // Main menu
    catalog: "🛍️ Catalog",
    cart: "🛒 Cart",
    profile: "👤 Profile",
    contactManager: "📞 Contact Manager",
    
    // Catalog
    categoriesTitle: "📂 Product Categories",
    chooseCategory: "Choose a category:",
    categoryEmpty: "❌ No products in this category yet",
    pageOf: "Page {current} of {total}",
    
    // Product
    price: "💰 Price: {price} RUB",
    description: "📝 Description:",
    addToCart: "🛒 Add to Cart",
    backToProducts: "🔙 Back to Products",
    backToCategories: "🔙 Categories",
    
    // Cart
    yourCart: "🛒 Your Cart",
    cartEmpty: "🛒 Your cart is empty",
    addToCartPrompt: "Add products from the catalog!",
    quantity: "{qty} pcs x {price} RUB = {total} RUB",
    total: "Total: {total} RUB",
    clearCart: "🗑️ Clear Cart",
    itemRemoved: "❌ {name} removed from cart",
    cartCleared: "🗑️ Cart cleared",
    
    // Checkout
    checkoutTitle: "💳 Checkout",
    items: "Items:",
    toPay: "To pay: {total} RUB",
    confirmPayment: "✅ Confirm and Pay",
    backToCart: "🔙 Back to Cart",
    orderConfirmed: "✅ Order #{id} confirmed!",
    orderDetails: "Amount: {total} RUB\n\nManager will contact you for details.",
    managerWillContact: "Manager will contact you soon.",
    
    // Profile
    profileTitle: "👤 Profile",
    itemsInCart: "🛒 In cart: {count} items for {total} RUB",
    
    // Manager
    managerContactTitle: "📞 Contact Manager",
    describeQuestion: "Describe your question or request:",
    requestSent: "✅ Your request has been sent to the manager.",
    requestCancelled: "❌ Request cancelled.",
    managerWillContactSoon: "We will contact you soon.",
    
    // Admin
    adminPanel: "🔑 Admin Panel",
    adminChooseAction: "Choose an action:",
    pendingOrders: "📦 Pending Orders",
    allOrders: "📋 All Orders",
    supportRequests: "💬 Support Requests",
    backToBot: "🔙 To Bot",
    noPendingOrders: "✅ No pending orders",
    noSupportRequests: "✅ No pending requests",
    accessDenied: "❌ Access denied",
    orderMarkedShipped: "✅ Order marked as shipped",
    requestClosed: "✅ Request closed",
    replyMode: "✍️ Reply Mode",
    enterReplyText: "Enter reply text for request #{id}:",
    replySent: "✅ Reply to request #{id} sent.",
    answerCancelled: "❌ Reply cancelled.",
    
    // Common
    back: "🔙 Back",
    cancel: "❌ Cancel",
    error: "❌ Error: {message}",
    notFound: "❌ Not found",
    loading: "⏳ Loading...",
    
    // Fallback
    fallbackMessage: "🤔 I didn't quite understand your request.",
    useMenuNavigation: "Please use the menu buttons for navigation:",
  },
};

export function t(lang: Language, key: keyof Translation, params?: Record<string, string | number>): string {
  let text = translations[lang]?.[key] || translations["ru"][key];
  
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
    }
  }
  
  return text;
}

export function getUserLanguage(userId: number): Language {
  // In production, store user preferences in database
  // For now, default to Russian
  return "ru";
}

export function setLanguage(lang: Language): void {
  // Store in user context
  console.log(`Language set to: ${lang}`);
}
