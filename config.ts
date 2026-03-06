// Bot Configuration
export interface Config {
  botToken: string;
  adminId: number;
  databaseUrl: string;
  environment: "development" | "production";
  webhookUrl?: string;
}

export const config: Config = {
  botToken: Deno.env.get("BOT_TOKEN") || "",
  adminId: parseInt(Deno.env.get("ADMIN_ID") || "0"),
  databaseUrl: Deno.env.get("DATABASE_URL") || "",
  environment: (Deno.env.get("ENVIRONMENT") as "development" | "production") || "development",
  webhookUrl: Deno.env.get("WEBHOOK_URL"),
};

export const isWebhook = config.environment === "production";

// Catalog categories
export const CATEGORIES: Record<string, string> = {
  tshirts: "👕 Футболки",
  hoodies: "🧥 Худи",
  jeans: "👖 Джинсы",
};

// Sample products
export const PRODUCTS: Record<string, Array<{
  id: string;
  name: string;
  description: string;
  price: number;
  photo_url: string;
}>> = {
  tshirts: [
    {
      id: "tshirt_001",
      name: "Premium White Tee",
      description: "Классическая белая футболка из 100% хлопка. Премиальное качество, идеальная посадка.",
      price: 2500,
      photo_url: "https://via.placeholder.com/800x600/f5f5f5/333333?text=Premium+White+Tee",
    },
    {
      id: "tshirt_002",
      name: "Black Basic Tee",
      description: "Базовая черная футболка. Универсальный элемент гардероба.",
      price: 2300,
      photo_url: "https://via.placeholder.com/800x600/333333/ffffff?text=Black+Basic+Tee",
    },
    {
      id: "tshirt_003",
      name: "Navy Stripe Tee",
      description: "Футболка в морскую полоску. Стиль и комфорт.",
      price: 2800,
      photo_url: "https://via.placeholder.com/800x600/1a237e/ffffff?text=Navy+Stripe+Tee",
    },
  ],
  hoodies: [
    {
      id: "hoodie_001",
      name: "Grey Premium Hoodie",
      description: "Серое худи премиум-класса. Мягкий флис внутри, плотный хлопок снаружи.",
      price: 5500,
      photo_url: "https://via.placeholder.com/800x600/9e9e9e/333333?text=Grey+Premium+Hoodie",
    },
    {
      id: "hoodie_002",
      name: "Black Urban Hoodie",
      description: "Черное худи в урбанистическом стиле. Капюшон с регулировкой.",
      price: 5900,
      photo_url: "https://via.placeholder.com/800x600/212121/ffffff?text=Black+Urban+Hoodie",
    },
  ],
  jeans: [
    {
      id: "jeans_001",
      name: "Classic Blue Jeans",
      description: "Классические синие джинсы. Прямой крой, средняя посадка.",
      price: 7500,
      photo_url: "https://via.placeholder.com/800x600/1565c0/ffffff?text=Classic+Blue+Jeans",
    },
    {
      id: "jeans_002",
      name: "Slim Fit Black Jeans",
      description: "Черные зауженные джинсы. Современный крой slim fit.",
      price: 8200,
      photo_url: "https://via.placeholder.com/800x600/424242/ffffff?text=Slim+Fit+Black+Jeans",
    },
    {
      id: "jeans_003",
      name: "Vintage Wash Jeans",
      description: "Джинсы с винтажной варкой. Уникальный эффект потертостей.",
      price: 8900,
      photo_url: "https://via.placeholder.com/800x600/5d4037/ffffff?text=Vintage+Wash+Jeans",
    },
  ],
};

export const ITEMS_PER_PAGE = 2;
